package httpapi

import "net/http"

// No swaggo/codegen dependency for four endpoints — the spec is hand-written
// and served as-is; swagger-ui itself loads from a CDN in the browser.
const openAPISpec = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Ravex Settlement Engine API",
    "version": "v1",
    "description": "Pari-mutuel pool aggregation and payout computation. In-memory only in local dev — pools reset on restart."
  },
  "paths": {
    "/health": {
      "get": {
        "summary": "Health check",
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/pools/{marketId}/stakes": {
      "post": {
        "summary": "Debit the caller's wallet and add a stake to a market's pool",
        "description": "Calls Wallet & Ledger's POST /wallet/me/stake synchronously before adding to the pool, using the caller's own Authorization header — a stake that isn't backed by a real debit is rejected, not recorded.",
        "security": [{ "Bearer": [] }],
        "parameters": [
          { "name": "marketId", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["outcomeId", "amount"],
                "properties": {
                  "outcomeId": { "type": "string", "format": "uuid" },
                  "amount": { "type": "integer", "format": "int64", "minimum": 1 }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Debited and updated pool snapshot", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/PoolSnapshot" } } } },
          "400": { "description": "outcomeId missing or amount not positive" },
          "401": { "description": "Missing or invalid bearer token" },
          "402": { "description": "Insufficient wallet balance" },
          "502": { "description": "Wallet service unreachable" }
        }
      }
    },
    "/pools/{marketId}": {
      "get": {
        "summary": "Get a market's current pool snapshot and implied odds",
        "parameters": [
          { "name": "marketId", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
        ],
        "responses": {
          "200": { "description": "Pool snapshot", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/PoolSnapshot" } } } }
        }
      }
    },
    "/pools/{marketId}/settle": {
      "post": {
        "summary": "Compute the payout ratio for a winning outcome",
        "parameters": [
          { "name": "marketId", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["winningOutcomeId"],
                "properties": { "winningOutcomeId": { "type": "string", "format": "uuid" } }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Settlement result", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/SettlementResult" } } } },
          "409": { "description": "No stakes were placed on the winning outcome" }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "Bearer": { "type": "apiKey", "name": "Authorization", "in": "header", "description": "A JWT from POST /auth/login, e.g. \"Bearer {token}\"" }
    },
    "schemas": {
      "PoolSnapshot": {
        "type": "object",
        "properties": {
          "marketId": { "type": "string" },
          "totals": { "type": "object", "additionalProperties": { "type": "integer" } },
          "impliedOdds": { "type": "object", "additionalProperties": { "type": "number" } },
          "totalPool": { "type": "integer" }
        }
      },
      "SettlementResult": {
        "type": "object",
        "properties": {
          "marketId": { "type": "string" },
          "winningOutcomeId": { "type": "string" },
          "totalPool": { "type": "integer" },
          "winningPool": { "type": "integer" },
          "payoutRatio": { "type": "number" }
        }
      }
    }
  }
}`

const swaggerUIPage = `<!doctype html>
<html>
<head>
  <title>Ravex Settlement Engine API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui" });
  </script>
</body>
</html>`

func (s *Server) handleOpenAPISpec(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(openAPISpec))
}

func (s *Server) handleSwaggerUI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	_, _ = w.Write([]byte(swaggerUIPage))
}
