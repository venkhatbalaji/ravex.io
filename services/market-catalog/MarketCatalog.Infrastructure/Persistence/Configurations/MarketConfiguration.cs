using MarketCatalog.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MarketCatalog.Infrastructure.Persistence.Configurations;

public sealed class MarketConfiguration : IEntityTypeConfiguration<Market>
{
    public void Configure(EntityTypeBuilder<Market> builder)
    {
        builder.ToTable("markets");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Status).HasConversion<string>().IsRequired();

        builder.HasMany(m => m.Outcomes)
            .WithOne()
            .HasForeignKey(o => o.MarketId);

        // A deleted category un-categorizes its markets rather than blocking
        // the delete or cascading — both would be worse admin UX.
        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(m => m.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        // Market.Outcomes is a read-only projection over a private backing field —
        // tell EF Core to materialize through the field, not a (nonexistent) setter.
        builder.Navigation(m => m.Outcomes).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
