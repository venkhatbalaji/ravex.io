using MarketCatalog.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MarketCatalog.Infrastructure.Persistence.Configurations;

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("categories");
        builder.HasKey(c => c.Id);
        builder.HasIndex(c => c.Name).IsUnique();
        builder.Property(c => c.Name).IsRequired();
    }
}
