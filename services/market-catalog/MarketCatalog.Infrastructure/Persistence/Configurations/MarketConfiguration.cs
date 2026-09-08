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

        // Market.Outcomes is a read-only projection over a private backing field —
        // tell EF Core to materialize through the field, not a (nonexistent) setter.
        builder.Navigation(m => m.Outcomes).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
