package httpapi

import "net/http"

// The public API spec is hand-written
// and served as-is; swagger-ui itself loads from a CDN in the browser.
const openAPISpec = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Ravex Settlement Engine API",
    "version": "v1",
    "description": "Durable stake admission, idempotent coin payouts and refunds, and private player prediction history. Administrative results are recorded through Market Catalog; internal resolution endpoints require service authentication."
  },
  "paths": {
    "/health/ready": {
      "get": {
        "summary": "Database readiness with a bounded probe",
        "responses": {"200": {"description": "Ready"}, "503": {"description": "Database unavailable"}}
      }
    },
    "/operations/settlement": {
      "get": {
        "summary": "Admin-only pending debit and payout backlog",
        "description": "One database snapshot of counts, oldest pending time, and oldest-first rows. Excludes player identities and credentials. Processing can move items between offset pages. Responses are not cacheable.",
        "security": [{"Bearer": []}],
        "parameters": [
          {"name": "limit", "in": "query", "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 50}},
          {"name": "offset", "in": "query", "schema": {"type": "integer", "minimum": 0, "maximum": 1000000, "default": 0}}
        ],
        "responses": {
          "200": {"description": "Consistent recovery snapshot", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Operations"}}}},
          "400": {"description": "Invalid pagination"},
          "401": {"description": "Authentication required"},
          "403": {"description": "Admin role required"},
          "502": {"description": "Dependency unavailable"}
        }
      }
    },
    "/health": {
      "get": {
        "summary": "Health check",
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/pools/{marketId}/stakes": {
      "post": {
        "summary": "Admit or retry a coin stake",
        "description": "Validates the player through Identity and saves a stake intent in PostgreSQL before requesting a service-authorized, idempotent Wallet debit. Reuse the same Idempotency-Key and payload after a timeout, 202, or 5xx. An admitted stake can complete after cutoff or market closure. A background worker recovers pending stakes; never create a new key to retry an uncertain request.",
        "security": [
          {
            "Bearer": []
          }
        ],
        "parameters": [
          {
            "name": "marketId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          },
          {
            "name": "Idempotency-Key",
            "in": "header",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "description": "Client-generated non-empty UUID, scoped to the authenticated player. Reuse for the same attempt."
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "outcomeId",
                  "amount"
                ],
                "properties": {
                  "outcomeId": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "amount": {
                    "type": "integer",
                    "format": "int64",
                    "minimum": 1
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Accepted stake and current pool snapshot",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/StakeSubmission"
                }
              }
            }
          },
          "400": {
            "description": "Invalid UUID, missing key, unknown outcome, or invalid positive integer amount"
          },
          "401": {
            "description": "Missing or invalid bearer token"
          },
          "402": {
            "description": "Insufficient wallet balance"
          },
          "404": {
            "description": "Market not found"
          },
          "409": {
            "description": "Market closed or key reused with a different payload"
          },
          "502": {
            "description": "Dependency or storage failure; retry the same key because a stake may already be admitted"
          },
          "202": {
            "description": "Durably admitted, debit decision still pending. Retry the same key.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/StakeSubmission"
                }
              }
            }
          }
        }
      }
    },
    "/pools/{marketId}": {
      "get": {
        "summary": "Get a market's current pool snapshot and implied odds",
        "parameters": [
          {
            "name": "marketId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Pool snapshot",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/PoolSnapshot"
                }
              }
            }
          }
        }
      }
    },
    "/pools/{marketId}/settle": {
      "post": {
        "summary": "Compute the payout ratio for a winning outcome",
        "parameters": [
          {
            "name": "marketId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "winningOutcomeId"
                ],
                "properties": {
                  "winningOutcomeId": {
                    "type": "string",
                    "format": "uuid"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Settlement result",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/SettlementResult"
                }
              }
            }
          },
          "409": {
            "description": "Admission still open, pending stakes, or no stakes on the winning outcome"
          },
          "401": {
            "description": "Missing or invalid player token"
          },
          "403": {
            "description": "Administrator role required"
          }
        },
        "security": [
          {
            "Bearer": []
          }
        ],
        "description": "Admin-only preview of the payout ratio. Does not record a result or transfer coins. Record the final decision through POST /markets/{marketId}/settle with evidence; cancel through POST /markets/{marketId}/cancel."
      }
    },
    "/predictions/me": {
      "get": {
        "summary": "List the authenticated player's predictions and confirmed coin returns",
        "security": [
          {
            "Bearer": []
          }
        ],
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            }
          },
          {
            "name": "offset",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 0,
              "maximum": 1000000,
              "default": 0
            }
          }
        ],
        "responses": {
          "200": {
            "description": "items with stake fields, result (pending/active/processing/won/lost/refunded/rejected), payout, and nullable nextOffset. Only confirmed wallet returns are exposed as payout."
          },
          "400": {
            "description": "Invalid pagination"
          },
          "401": {
            "description": "Missing or invalid player token"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "Bearer": {
        "type": "apiKey",
        "name": "Authorization",
        "in": "header",
        "description": "A JWT from POST /auth/login, e.g. \"Bearer {token}\""
      }
    },
    "schemas": {
      "PendingOperation": {
        "type": "object",
        "required": ["id", "marketId", "kind", "amount", "createdAt", "updatedAt"],
        "properties": {
          "id": {"type": "string", "format": "uuid"},
          "marketId": {"type": "string", "format": "uuid"},
          "kind": {"type": "string", "enum": ["debit", "payout", "refund"]},
          "amount": {"type": "integer", "format": "int64", "minimum": 0},
          "createdAt": {"type": "string", "format": "date-time"},
          "updatedAt": {"type": "string", "format": "date-time"}
        }
      },
      "Operations": {
        "type": "object",
        "required": ["observedAt", "pendingDebits", "pendingResolutions", "oldestPendingAt", "items", "nextOffset"],
        "properties": {
          "observedAt": {"type": "string", "format": "date-time"},
          "pendingDebits": {"type": "integer", "format": "int64", "minimum": 0},
          "pendingResolutions": {"type": "integer", "format": "int64", "minimum": 0},
          "oldestPendingAt": {"type": "string", "format": "date-time", "nullable": true},
          "items": {"type": "array", "items": {"$ref": "#/components/schemas/PendingOperation"}},
          "nextOffset": {"type": "integer", "nullable": true}
        }
      },
      "PoolSnapshot": {
        "type": "object",
        "properties": {
          "marketId": {
            "type": "string"
          },
          "totals": {
            "type": "object",
            "additionalProperties": {
              "type": "integer"
            }
          },
          "impliedOdds": {
            "type": "object",
            "additionalProperties": {
              "type": "number"
            }
          },
          "totalPool": {
            "type": "integer"
          }
        }
      },
      "SettlementResult": {
        "type": "object",
        "properties": {
          "marketId": {
            "type": "string"
          },
          "winningOutcomeId": {
            "type": "string"
          },
          "totalPool": {
            "type": "integer"
          },
          "winningPool": {
            "type": "integer"
          },
          "payoutRatio": {
            "type": "number"
          }
        }
      },
      "StakeSubmission": {
        "allOf": [
          {
            "$ref": "#/components/schemas/PoolSnapshot"
          },
          {
            "type": "object",
            "required": [
              "stake"
            ],
            "properties": {
              "stake": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "marketId": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "outcomeId": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "amount": {
                    "type": "integer",
                    "format": "int64"
                  },
                  "state": {
                    "type": "string",
                    "enum": [
                      "pending",
                      "accepted",
                      "rejected"
                    ]
                  },
                  "createdAt": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "updatedAt": {
                    "type": "string",
                    "format": "date-time"
                  }
                }
              }
            }
          }
        ]
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
