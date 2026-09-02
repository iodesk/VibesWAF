package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/iodesk/VibesWAF/internal/acme"
	v1 "github.com/iodesk/VibesWAF/internal/api/v1"
	"github.com/iodesk/VibesWAF/internal/cache"
	"github.com/iodesk/VibesWAF/internal/challenge"
	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/logger"
	"github.com/iodesk/VibesWAF/internal/migration"
	"github.com/iodesk/VibesWAF/internal/model"
	"github.com/iodesk/VibesWAF/internal/pipeline"
	"github.com/iodesk/VibesWAF/internal/pipeline/handlers"
	"github.com/iodesk/VibesWAF/internal/ratelimit"
	"github.com/iodesk/VibesWAF/internal/repository"
	"github.com/iodesk/VibesWAF/internal/service"
	"github.com/iodesk/VibesWAF/internal/stream"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	appCfg := config.GetAppConfig()
	defer appCfg.Close()

	appCfg.LogStartup("=== VibesWAF Starting === debug=%v level=%s", appCfg.IsDebug(), appCfg.LogLevel)

	psqlDSN := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		os.Getenv("PSQL_HOST"),
		os.Getenv("PSQL_PORT"),
		os.Getenv("PSQL_USER"),
		os.Getenv("PSQL_PASS"),
		os.Getenv("PSQL_NAME"),
		getEnvOrDefault("PSQL_SSL", "disable"),
	)

	pg, err := config.NewPostgres(psqlDSN)
	if err != nil {
		appCfg.LogStartup("FATAL: PostgreSQL connect failed: %v", err)
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer pg.Close()
	appCfg.LogStartup("PostgreSQL: ok")

	if getEnvBool("AUTO_MIGRATE", true) {
		if err := migration.Run(pg.DB()); err != nil {
			appCfg.LogStartup("FATAL: Migration failed: %v", err)
			log.Fatalf("Migration failed: %v", err)
		}
		appCfg.LogStartup("Migration: ok")
	} else {
		appCfg.LogStartup("Migration: skipped (AUTO_MIGRATE=false)")
	}

	clickhouseLogger := logger.NewClickhouse()
	err = clickhouseLogger.Connect(
		os.Getenv("CLICKHOUSE_HOST"),
		os.Getenv("CLICKHOUSE_DB"),
		os.Getenv("CLICKHOUSE_USER"),
		os.Getenv("CLICKHOUSE_PASSWORD"),
	)
	if err != nil {
		appCfg.LogStartup("ClickHouse: unavailable (%v) -- logging disabled, reconnect in background", err)
	} else {
		defer clickhouseLogger.Close()
		appCfg.LogStartup("ClickHouse: ok")

		if err := migration.RunClickhouse(clickhouseLogger.Conn()); err != nil {
			appCfg.LogWarn("[ClickHouse] Migration failed: %v", err)
		} else {
			appCfg.LogStartup("ClickHouse migration: ok")
		}

		clickhouseLogger.StartRetentionWorker(ctx, appCfg)
	}

	repos := repository.NewRepositories(pg.DB())

	var redisClient *cache.RedisClient
	if getEnvOrDefault("ENABLE_REDIS", "false") == "true" {
		redisHost := getEnvOrDefault("REDIS_HOST", "localhost:6379")
		redisPass := os.Getenv("REDIS_PASS")
		redisClient = cache.NewRedisClient(redisHost, redisPass)
		defer redisClient.Close()
	} else {
		appCfg.LogStartup("Redis: disabled (ENABLE_REDIS=false)")
		redisClient = cache.NewDisabledClient()
	}
	decisionCache := cache.NewDecisionCache(redisClient)
	certDir := getEnvOrDefault("CERT_DIR", "/opt/certs")
	acmeEmail := getEnvOrDefault("ACME_EMAIL", "admin@example.com")
	acmeService := acme.NewService(certDir, acmeEmail)

	if !acmeService.IsInstalled() {
		appCfg.LogStartup("ACME: not installed -- SSL auto-provisioning disabled")
		acmeService = nil
	} else {
		appCfg.LogStartup("ACME: ok")
	}

	ruleService := service.NewRuleService(repos.Rule, 5*time.Minute)
	ipAccessService := service.NewIPAccessService(repos.IPAccess)
	defer ipAccessService.Stop()
	ipReputationService := service.NewIPReputationService(repos.IPReputation, repos.Settings)
	certificateService := service.NewCertificateService(repos.Certificate, acmeService)

	maxmindPath := getEnvOrDefault("MAXMIND_DB_PATH", "/opt/maxmind")
	maxmindService, err := service.NewMaxMindService(maxmindPath)
	if err != nil {
		appCfg.LogStartup("MaxMind: unavailable -- GeoIP/ASN disabled")
	} else {
		defer maxmindService.Close()
		appCfg.LogStartup("MaxMind: ok")
	}

	streamProxy := stream.NewProxy(ipAccessService, clickhouseLogger, &maxmindAdapter{maxmind: maxmindService})
	defer streamProxy.Close()
	nginxManager := stream.NewNginxManager()

	appService := service.NewAppService(repos.App, acmeService, certificateService, streamProxy, nginxManager)

	wafCfg, err := repos.Settings.GetWAFConfig()
	if err != nil {
		appCfg.LogWarn("[WAF] Failed to load config from database, using default: %v", err)
		wafCfg = model.DefaultWAFConfig()
	}
	appCfg.LogStartup("WAF engine: PL=%d threshold=%d", wafCfg.ParanoiaLevel, wafCfg.AnomalyThreshold)

	wafService := service.NewWAFService(appService, repos.Settings, clickhouseLogger, appCfg)
	rateLimitService := service.NewRateLimitService(repos.Settings)

	rlCfg, rlCfgErr := repos.Settings.GetRateLimitConfig()
	if rlCfgErr != nil {
		rlCfg = model.DefaultRateLimitConfig()
	}
	floodProtector := ratelimit.NewFloodProtector(
		rlCfg.Basic.Count, rlCfg.Attack.Count, rlCfg.Error.Count,
		time.Duration(rlCfg.Basic.Duration)*time.Second,
		time.Duration(rlCfg.Attack.Duration)*time.Second,
		time.Duration(rlCfg.Error.Duration)*time.Second,
	)

	var cachedFloodCfg ratelimit.FloodConfig
	var cachedFloodCfgTime time.Time
	var cachedFloodMu sync.Mutex
	cachedFloodCfg = ratelimit.FloodConfig{
		BasicLimit:   rlCfg.Basic.Count,
		BasicWindow:  time.Duration(rlCfg.Basic.Duration) * time.Second,
		AttackLimit:  rlCfg.Attack.Count,
		AttackWindow: time.Duration(rlCfg.Attack.Duration) * time.Second,
		ErrorLimit:   rlCfg.Error.Count,
		ErrorWindow:  time.Duration(rlCfg.Error.Duration) * time.Second,
	}
	cachedFloodCfgTime = time.Now()

	floodProtector.SetConfigGetter(func() ratelimit.FloodConfig {
		cachedFloodMu.Lock()
		defer cachedFloodMu.Unlock()

		if time.Since(cachedFloodCfgTime) < 10*time.Second {
			return cachedFloodCfg
		}

		cfg, err := repos.Settings.GetRateLimitConfig()
		if err != nil {
			return cachedFloodCfg
		}
		cachedFloodCfg = ratelimit.FloodConfig{
			BasicLimit:   cfg.Basic.Count,
			BasicWindow:  time.Duration(cfg.Basic.Duration) * time.Second,
			AttackLimit:  cfg.Attack.Count,
			AttackWindow: time.Duration(cfg.Attack.Duration) * time.Second,
			ErrorLimit:   cfg.Error.Count,
			ErrorWindow:  time.Duration(cfg.Error.Duration) * time.Second,
		}
		cachedFloodCfgTime = time.Now()
		return cachedFloodCfg
	})

	botIPRangeFetcher := service.NewBotIPRangeFetcher(repos.BotIPRange)

	botDetectionService := service.NewBotDetectionService(repos.BotPattern, repos.Settings, maxmindService, botIPRangeFetcher, redisClient)

	bcryptCost := 12
	if val := os.Getenv("BCRYPT_COST"); val != "" {
		if cost, err := strconv.Atoi(val); err == nil && cost >= 4 && cost <= 31 {
			bcryptCost = cost
		}
	}
	authService := service.NewAuthService(repos.User, repos.Session, bcryptCost)

	appCfg.LogStartup("Ready.")

	scoringCfg, err := repos.Settings.GetScoringConfig()
	if err != nil {
		appCfg.LogWarn("[SCORING] Failed to load config from database, using default: %v", err)
		scoringCfg = model.DefaultScoringConfig()
	}
	appCfg.LogStartup("Scoring engine: block=%d challenge=%d",
		scoringCfg.Thresholds.Block, scoringCfg.Thresholds.Challenge)

	settingsCache := service.NewSettingsCache(repos.Settings)
	defer settingsCache.Stop()

	getScoringConfig := func() *model.ScoringConfig {
		if cfg := settingsCache.GetScoringConfig(); cfg != nil {
			return cfg
		}
		return &scoringCfg
	}

	challengeRegistry := challenge.NewRegistry()
	challengeRegistry.Register(challenge.NewSliderChallenge())

	botCfg := botDetectionService.GetConfig()
	challengeTTL := time.Duration(botCfg.ChallengeWait) * time.Second
	if challengeTTL < 30*time.Second {
		challengeTTL = 60 * time.Second
	}
	challengeStore := challenge.NewStore(challengeTTL, 3)

	trustedHistoryScorer := handlers.NewTrustedHistoryScorer(getScoringConfig, redisClient)
	stableSessionScorer := handlers.NewStableSessionScorer(getScoringConfig, redisClient)

	p := pipeline.New(pipeline.PipelineConfig{
		Phase1: []pipeline.Handler{
			handlers.NewChallengeValidator(botDetectionService),
			handlers.NewIPAccessHandler(ipAccessService),
			handlers.NewFloodHandler(floodProtector, rateLimitService),
			handlers.NewRateLimitHandler(rateLimitService),
			handlers.NewCacheCheckHandler(decisionCache),
			handlers.NewRulesEngineHandler(ruleService, decisionCache),
		},
		Phase2: []pipeline.Handler{
			handlers.NewIPReputationScorer(getScoringConfig, ipReputationService),
			handlers.NewBotDetectionHandler(botDetectionService),
			handlers.NewWAFEngineHandler(wafService),
			handlers.NewProtocolAnomalyHandler(getScoringConfig, repos.Settings),
			trustedHistoryScorer,
			stableSessionScorer,
			handlers.NewTrustScorer(getScoringConfig, botDetectionService),
		},
		Phase3: pipeline.NewDecisionEngine(getScoringConfig),
		Phase4: []pipeline.Handler{
			pipeline.NewBlockHandler(),
			handlers.NewChallengeHandler(challengeRegistry, challengeStore, botDetectionService),
		},
		ScoringConfig:    &scoringCfg,
		GetScoringConfig: getScoringConfig,
	})

	demoService := service.NewDemoService(repos.App, repos.Certificate, repos.Settings)
	demoService.Start()
	defer demoService.Stop()

	router := v1.NewRouter(
		ruleService,
		appService,
		wafService,
		clickhouseLogger,
		p,
		repos.BotPattern,
		repos.Settings,
		ipAccessService,
		authService,
		botDetectionService,
		maxmindService,
		rateLimitService,
		certificateService,
		appCfg,
		decisionCache,
		challengeStore,
		challengeRegistry,
		repos.BotIPRange,
		botIPRangeFetcher,
		ipReputationService,
		floodProtector,
		trustedHistoryScorer,
		settingsCache,
		newUIHandler(),
		appCfg.DashboardHost,
	)

	httpPort := getEnvOrDefault("HTTP_PORT", "127.0.0.1:3000")
	httpServer := &http.Server{
		Addr:    httpPort,
		Handler: router,
	}

	go func() {
		appCfg.LogStartup("HTTP listening on %s", httpPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			appCfg.LogStartup("FATAL: HTTP server error: %v", err)
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	appService.StartStreamApps()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	appCfg.LogStartup("Shutting down...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		appCfg.LogError("Server forced to shutdown: %v", err)
	}

	if err := wafService.Close(); err != nil {
		appCfg.LogError("Failed to close WAF service: %v", err)
	}

	botDetectionService.Stop()
	rateLimitService.Stop()
	floodProtector.Stop()
	decisionCache.Stop()
	challengeStore.Stop()
	appService.Stop()

	appCfg.LogStartup("Stopped.")
}

func getEnvBool(key string, defaultValue bool) bool {
	if val := os.Getenv(key); val != "" {
		return strings.ToLower(val) == "true"
	}
	return defaultValue
}

func getEnvOrDefault(key, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}

type maxmindAdapter struct {
	maxmind interface {
		Lookup(ip string) (*service.GeoIPResult, error)
	}
}

func (m *maxmindAdapter) Lookup(ip string) (*stream.GeoResult, error) {
	if m.maxmind == nil {
		return nil, fmt.Errorf("maxmind not available")
	}
	r, err := m.maxmind.Lookup(ip)
	if err != nil {
		return nil, err
	}
	return &stream.GeoResult{
		Country:     r.Country,
		CountryCode: r.CountryCode,
		ASN:         r.ASN,
		ASNOrg:      r.ASNOrg,
	}, nil
}