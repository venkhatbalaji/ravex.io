using MarketCatalog.Application.Contracts;
using MarketCatalog.Application.Exceptions;
using MarketCatalog.Domain.Entities;
using MarketCatalog.Domain.Repositories;

namespace MarketCatalog.Application.UseCases;

public interface IListCategoriesUseCase
{
    Task<IReadOnlyList<CategoryDto>> ExecuteAsync(CancellationToken ct = default);
}

public sealed class ListCategoriesUseCase : IListCategoriesUseCase
{
    private readonly ICategoryRepository _categories;

    public ListCategoriesUseCase(ICategoryRepository categories) => _categories = categories;

    public async Task<IReadOnlyList<CategoryDto>> ExecuteAsync(CancellationToken ct = default) =>
        (await _categories.GetAllAsync(ct)).Select(CategoryDto.From).ToList();
}

public interface ICreateCategoryUseCase
{
    Task<CategoryDto> ExecuteAsync(CreateCategoryRequest request, CancellationToken ct = default);
}

public sealed class CreateCategoryUseCase : ICreateCategoryUseCase
{
    private readonly ICategoryRepository _categories;

    public CreateCategoryUseCase(ICategoryRepository categories) => _categories = categories;

    public async Task<CategoryDto> ExecuteAsync(CreateCategoryRequest request, CancellationToken ct = default)
    {
        var category = Category.Create(request.Name);
        await _categories.AddAsync(category, ct);
        return CategoryDto.From(category);
    }
}

public interface IUpdateCategoryUseCase
{
    Task<CategoryDto> ExecuteAsync(Guid id, UpdateCategoryRequest request, CancellationToken ct = default);
}

public sealed class UpdateCategoryUseCase : IUpdateCategoryUseCase
{
    private readonly ICategoryRepository _categories;

    public UpdateCategoryUseCase(ICategoryRepository categories) => _categories = categories;

    public async Task<CategoryDto> ExecuteAsync(Guid id, UpdateCategoryRequest request, CancellationToken ct = default)
    {
        var category = await _categories.GetByIdAsync(id, ct) ?? throw new CategoryNotFoundException(id);
        category.Rename(request.Name);
        await _categories.SaveChangesAsync(ct);
        return CategoryDto.From(category);
    }
}

public interface IDeleteCategoryUseCase
{
    Task ExecuteAsync(Guid id, CancellationToken ct = default);
}

public sealed class DeleteCategoryUseCase : IDeleteCategoryUseCase
{
    private readonly ICategoryRepository _categories;

    public DeleteCategoryUseCase(ICategoryRepository categories) => _categories = categories;

    public async Task ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var category = await _categories.GetByIdAsync(id, ct) ?? throw new CategoryNotFoundException(id);
        await _categories.DeleteAsync(category, ct);
    }
}
