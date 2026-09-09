using System.Security.Claims;
using Wallet.Application.Contracts;
using Wallet.Application.Exceptions;
using Wallet.Application.UseCases;

namespace Wallet.Api.Endpoints;

public static class WalletEndpoints
{
    public static void MapWalletEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/wallet/me").RequireAuthorization();

        group.MapPost("/earn", async (EarnRequest request, ClaimsPrincipal principal, IEarnCoinsUseCase useCase) =>
        {
            try
            {
                var result = await useCase.ExecuteAsync(CurrentUserId(principal), request);
                return Results.Ok(result);
            }
            catch (UnknownEarnReasonException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (AlreadyClaimedTodayException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapGet("/balance", async (ClaimsPrincipal principal, IGetBalanceUseCase useCase) =>
            Results.Ok(await useCase.ExecuteAsync(CurrentUserId(principal))));

        group.MapGet("/ledger", async (ClaimsPrincipal principal, IGetLedgerUseCase useCase) =>
            Results.Ok(await useCase.ExecuteAsync(CurrentUserId(principal))));
    }

    private static Guid CurrentUserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
