package middleware

import (
	"net/http"

	"github.com/yourapp/waf/internal/service"
)


type AuthMiddleware struct {
	authService *service.AuthService
}


func NewAuthMiddleware(authService *service.AuthService) *AuthMiddleware {
	return &AuthMiddleware{
		authService: authService,
	}
}


func (m *AuthMiddleware) Authenticate(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		cookie, err := r.Cookie("session")
		if err != nil {
			http.Error(w, `{"error":"Unauthorized - No session cookie"}`, http.StatusUnauthorized)
			return
		}


		session, err := m.authService.ValidateSession(cookie.Value)
		if err != nil {
			http.Error(w, `{"error":"Unauthorized - Invalid or expired session"}`, http.StatusUnauthorized)
			return
		}


		r.Header.Set("X-User-ID", string(rune(session.UserID)))
		r.Header.Set("X-Username", session.Username)


		next(w, r)
	}
}
