using System.Security.Claims;
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

        // Preserve the legacy array shape while bounding its response.
        group.MapGet("", async (string? status, string? search, Guid? categoryId, string? phase,
            int? limit, int? offset, IListMarketsUseCase useCase, HttpContext context, CancellationToken ct) =>
            await Browse(useCase, context, status, search, categoryId, phase, limit ?? 100, offset ?? 0, true, ct));
        group.MapGet("/browse", async (string? status, string? search, Guid? categoryId, string? phase,
            int? limit, int? offset, IListMarketsUseCase useCase, HttpContext context, CancellationToken ct) =>
            await Browse(useCase, context, status, search, categoryId, phase, limit ?? 20, offset ?? 0, false, ct));

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

        group.MapPost("/{id:guid}/settle", async (Guid id, SettleMarketRequest request, ClaimsPrincipal principal, ISettleMarketUseCase useCase) =>
            await Try(() => useCase.ExecuteAsync(id, request, Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!)))).RequireAuthorization("admin");
        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelMarketRequest request, ClaimsPrincipal principal, ICancelMarketUseCase useCase) =>
            await Try(() => useCase.ExecuteAsync(id, request, Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!)))).RequireAuthorization("admin");

    }

    private static async Task<IResult> Browse(IListMarketsUseCase useCase, HttpContext context,
        string? status, string? search, Guid? categoryId, string? phase, int limit, int offset, bool legacy, CancellationToken ct)
    {
        context.Response.Headers.CacheControl = "no-store";
        try
        {
            var page = await useCase.ExecuteAsync(status, search, categoryId, phase, limit, offset, ct);
            return legacy ? Results.Ok(page.Items) : Results.Ok(page);
        }
        catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
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
