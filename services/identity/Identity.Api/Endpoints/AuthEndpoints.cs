using System.Security.Claims;
using Identity.Application.Contracts;
using Identity.Application.Exceptions;
using Identity.Application.UseCases;

namespace Identity.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth");

        group.MapPost("/register", async (RegisterUserRequest request, IRegisterUserUseCase useCase) =>
        {
            try
            {
                var user = await useCase.ExecuteAsync(request);
                return Results.Created($"/users/{user.Id}", user);
            }
            catch (EmailAlreadyRegisteredException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
            catch (WeakPasswordException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/login", async (LoginRequest request, ILoginUseCase useCase) =>
        {
            try
            {
                var result = await useCase.ExecuteAsync(request);
                return Results.Ok(result);
            }
            catch (InvalidCredentialsException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status401Unauthorized);
            }
        });

        app.MapGet("/me", (ClaimsPrincipal principal) => Results.Ok(new
        {
            id = principal.FindFirstValue(ClaimTypes.NameIdentifier),
            email = principal.FindFirstValue(ClaimTypes.Email),
            role = principal.FindFirstValue(ClaimTypes.Role)
        })).RequireAuthorization();
    }
}
