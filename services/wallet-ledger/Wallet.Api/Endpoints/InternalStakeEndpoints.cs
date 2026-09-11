using System.Security.Cryptography;
using System.Text;
using Wallet.Application.Contracts;
using Wallet.Application.Exceptions;
using Wallet.Application.UseCases;

namespace Wallet.Api.Endpoints;

public static class InternalStakeEndpoints
{
    public static void MapInternalStakeEndpoints(this IEndpointRouteBuilder app, string serviceKey)
    {
        var expected = SHA256.HashData(Encoding.UTF8.GetBytes(serviceKey));
        app.MapPost("/internal/settlements/{marketId:guid}", async (Guid marketId, PaySettlementRequest request, HttpContext context, PaySettlementUseCase useCase) =>
        {
            var supplied = SHA256.HashData(Encoding.UTF8.GetBytes(context.Request.Headers["X-Service-Key"].ToString()));
            if (!CryptographicOperations.FixedTimeEquals(expected, supplied)) return Results.Unauthorized();
            try { return Results.Ok(await useCase.ExecuteAsync(marketId, request, context.RequestAborted)); }
            catch (InvalidPayoutException ex) { return Results.BadRequest(new { error = ex.Message }); }
            catch (StakeConflictException ex) { return Results.Conflict(new { error = ex.Message }); }
            catch (OverflowException) { return Results.BadRequest(new { error = "Payout total is too large." }); }
        });
        app.MapPost("/internal/stakes/{stakeId:guid}", async (
            Guid stakeId, PlaceStakeRequest request, HttpContext context, IPlaceStakeUseCase useCase) =>
        {
            var supplied = SHA256.HashData(Encoding.UTF8.GetBytes(context.Request.Headers["X-Service-Key"].ToString()));
            if (!CryptographicOperations.FixedTimeEquals(expected, supplied))
                return Results.Unauthorized();
            if (stakeId == Guid.Empty || request.UserId == Guid.Empty ||
                request.MarketId == Guid.Empty || request.OutcomeId == Guid.Empty)
                return Results.BadRequest(new { error = "Non-empty stake, user, market and outcome IDs are required." });
            try
            {
                var result = await useCase.ExecuteAsync(stakeId, request, context.RequestAborted);
                return Results.Json(result, statusCode: result.Accepted ? 200 : 402);
            }
            catch (InvalidStakeAmountException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (StakeConflictException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });
    }
}
