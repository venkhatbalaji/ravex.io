using Branding.Application.Contracts;
using Branding.Application.UseCases;
using Branding.Domain.Exceptions;

namespace Branding.Api.Endpoints;

public static class ThemeEndpoints
{
    public static void MapThemeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/branding/theme");

        group.MapGet("", async (IGetThemeUseCase useCase) => Results.Ok(await useCase.ExecuteAsync()));

        group.MapPut("", async (UpdateThemeRequest request, IUpdateThemeUseCase useCase) =>
        {
            try
            {
                return Results.Ok(await useCase.ExecuteAsync(request));
            }
            catch (BrandingDomainException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization("admin");
    }
}
