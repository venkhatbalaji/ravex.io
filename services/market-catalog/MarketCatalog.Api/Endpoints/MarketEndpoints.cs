using MarketCatalog.Application.Contracts;
using MarketCatalog.Application.Exceptions;
using MarketCatalog.Application.UseCases;
using MarketCatalog.Domain.Exceptions;

namespace MarketCatalog.Api.Endpoints;

public static class MarketEndpoints
{
    public static void MapMarketEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/markets");

        group.MapGet("", async (string? status, IListMarketsUseCase useCase) =>
            Results.Ok(await useCase.ExecuteAsync(status)));

        group.MapGet("/{id:guid}", async (Guid id, IGetMarketUseCase useCase) =>
            await Try(() => useCase.ExecuteAsync(id)));

        group.MapPost("", async (CreateMarketRequest request, ICreateMarketUseCase useCase) =>
            await Try(async () =>
            {
                var market = await useCase.ExecuteAsync(request);
                return Results.Created($"/markets/{market.Id}", market);
            })).RequireAuthorization("admin");

        group.MapPost("/{id:guid}/lock", async (Guid id, ILockMarketUseCase useCase) =>
            await Try(() => useCase.ExecuteAsync(id))).RequireAuthorization("admin");

        group.MapPost("/{id:guid}/settle", async (Guid id, SettleMarketRequest request, ISettleMarketUseCase useCase) =>
            await Try(() => useCase.ExecuteAsync(id, request))).RequireAuthorization("admin");
    }

    private static async Task<IResult> Try(Func<Task<MarketDto>> action)
    {
        try
        {
            return Results.Ok(await action());
        }
        catch (PendingStakesException ex)
        {
            return Results.Conflict(new { error = ex.Message });
        }
        catch (StakeAdmissionUnavailableException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status502BadGateway);
        }
        catch (MarketNotFoundException ex)
        {
            return Results.NotFound(new { error = ex.Message });
        }
        catch (CategoryNotFoundException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        catch (InvalidMarketDefinitionException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        catch (UnknownOutcomeException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        catch (InvalidMarketStateException ex)
        {
            return Results.Conflict(new { error = ex.Message });
        }
    }

    private static async Task<IResult> Try(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (PendingStakesException ex)
        {
            return Results.Conflict(new { error = ex.Message });
        }
        catch (StakeAdmissionUnavailableException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status502BadGateway);
        }
        catch (MarketNotFoundException ex)
        {
            return Results.NotFound(new { error = ex.Message });
        }
        catch (CategoryNotFoundException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        catch (InvalidMarketDefinitionException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        catch (UnknownOutcomeException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        catch (InvalidMarketStateException ex)
        {
            return Results.Conflict(new { error = ex.Message });
        }
    }
}
