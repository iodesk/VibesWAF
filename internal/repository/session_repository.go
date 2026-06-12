package repository

import (
	"database/sql"
	"time"
)

type SessionRow struct {
	Token     string
	UserID    int
	ExpiresAt time.Time
	CreatedAt time.Time
}

type SessionRepository struct {
	db *sql.DB
}

func NewSessionRepository(db *sql.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) Create(token string, userID int, expiresAt time.Time) error {
	query := `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`
	_, err := r.db.Exec(query, token, userID, expiresAt)
	return err
}

func (r *SessionRepository) FindByToken(token string) (*SessionRow, error) {
	row := &SessionRow{}
	query := `SELECT token, user_id, expires_at, created_at FROM sessions WHERE token = $1`
	err := r.db.QueryRow(query, token).Scan(&row.Token, &row.UserID, &row.ExpiresAt, &row.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return row, nil
}

func (r *SessionRepository) Delete(token string) error {
	query := `DELETE FROM sessions WHERE token = $1`
	_, err := r.db.Exec(query, token)
	return err
}

func (r *SessionRepository) DeleteByUserID(userID int) error {
	query := `DELETE FROM sessions WHERE user_id = $1`
	_, err := r.db.Exec(query, userID)
	return err
}

func (r *SessionRepository) DeleteExpired() (int64, error) {
	query := `DELETE FROM sessions WHERE expires_at < NOW()`
	result, err := r.db.Exec(query)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
