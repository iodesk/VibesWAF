package rule

import (
	"testing"
)

func TestBooleanFields(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		wantErr    bool
	}{
		{
			name:       "device.is_mobile eq true",
			expression: "device.is_mobile eq true",
			wantErr:    false,
		},
		{
			name:       "device.is_mobile eq false",
			expression: "device.is_mobile eq false",
			wantErr:    false,
		},
		{
			name:       "client.is_mobile eq true",
			expression: "client.is_mobile eq true",
			wantErr:    false,
		},
		{
			name:       "device.is_desktop eq true",
			expression: "device.is_desktop eq true",
			wantErr:    false,
		},
		{
			name:       "device.is_tablet eq true",
			expression: "device.is_tablet eq true",
			wantErr:    false,
		},
		{
			name:       "ip.is_datacenter eq true",
			expression: "ip.is_datacenter eq true",
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			lexer := NewLexer(tt.expression)
			tokens, err := lexer.Tokenize()
			if err != nil {
				if !tt.wantErr {
					t.Errorf("Tokenize() error = %v, wantErr %v", err, tt.wantErr)
				}
				return
			}


			parser := NewParser(tokens)
			ast, err := parser.Parse()
			if err != nil {
				if !tt.wantErr {
					t.Errorf("Parse() error = %v, wantErr %v", err, tt.wantErr)
				}
				return
			}


			validator := NewValidator()
			err = validator.Validate(ast)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
