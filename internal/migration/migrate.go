package migration

import (
	"context"
	"database/sql"
	_ "embed"
	"strings"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

//go:embed init_postgres.sql
var initSQL string

//go:embed init_clickhouse.sql
var initClickhouseSQL string

func Run(db *sql.DB) error {
	_, err := db.Exec(initSQL)
	return err
}

func RunClickhouse(conn driver.Conn) error {
	if conn == nil {
		return nil
	}
	ctx := context.Background()

	// Run each statement separately — ClickHouse doesn't support multi-statement exec
	statements := splitSQL(initClickhouseSQL)
	for _, stmt := range statements {
		if stmt == "" {
			continue
		}
		if err := conn.Exec(ctx, stmt); err != nil {
			// Log but don't fail on ALTER — column may already exist
			if !isAlterColumnExists(err) {
				return err
			}
		}
	}
	return nil
}

func splitSQL(sql string) []string {
	var statements []string
	current := ""
	for _, line := range strings.Split(sql, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			continue
		}
		current += line + "\n"
		if strings.HasSuffix(trimmed, ";") {
			statements = append(statements, strings.TrimSpace(current))
			current = ""
		}
	}
	if strings.TrimSpace(current) != "" {
		statements = append(statements, strings.TrimSpace(current))
	}
	return statements
}

func isAlterColumnExists(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "column with this name already exists") ||
		strings.Contains(msg, "duplicate column")
}
