using MarketCatalog.Application.Contracts;
using MarketCatalog.Application.Exceptions;
using MarketCatalog.Application.UseCases;
using MarketCatalog.Domain.Exceptions;

namespace MarketCatalog.Api.Endpoints;

public static class CategoryEndpoints
{
    public static void MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/categories");

        group.MapGet("", async (IListCategoriesUseCase useCase) => Results.Ok(await useCase.ExecuteAsync()));

        group.MapPost("", async (CreateCategoryRequest request, ICreateCategoryUseCase useCase) =>
        {
            try
            {
                var category = await useCase.ExecuteAsync(request);
                return Results.Created($"/categories/{category.Id}", category);
            }
            catch (InvalidCategoryDefinitionException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization("admin");

        group.MapPut("/{id:guid}", async (Guid id, UpdateCategoryRequest request, IUpdateCategoryUseCase useCase) =>
        {
            try
            {
                return Results.Ok(await useCase.ExecuteAsync(id, request));
            }
            catch (CategoryNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (InvalidCategoryDefinitionException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization("admin");

        group.MapDelete("/{id:guid}", async (Guid id, IDeleteCategoryUseCase useCase) =>
        {
            try
            {
                await useCase.ExecuteAsync(id);
                return Results.NoContent();
            }
            catch (CategoryNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        }).RequireAuthorization("admin");
    }
}
