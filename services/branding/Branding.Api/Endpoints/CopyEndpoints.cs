using Branding.Application.Contracts;
using Branding.Application.UseCases;
using Branding.Domain.Exceptions;

namespace Branding.Api.Endpoints;

public static class CopyEndpoints
{
    public static void MapCopyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/branding/copy");

        group.MapGet("", async (IGetCopyOverridesUseCase useCase) => Results.Ok(await useCase.ExecuteAsync()));

        group.MapPut("/{key}", async (string key, UpsertCopyOverrideRequest request, IUpsertCopyOverrideUseCase useCase) =>
        {
            try
            {
                return Results.Ok(await useCase.ExecuteAsync(key, request));
            }
            catch (BrandingDomainException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization("admin");

        group.MapDelete("/{key}", async (string key, IDeleteCopyOverrideUseCase useCase) =>
        {
            await useCase.ExecuteAsync(key);
            return Results.NoContent();
        }).RequireAuthorization("admin");
    }
}
