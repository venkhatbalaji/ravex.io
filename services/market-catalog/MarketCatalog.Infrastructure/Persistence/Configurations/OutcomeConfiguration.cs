using MarketCatalog.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MarketCatalog.Infrastructure.Persistence.Configurations;

public sealed class OutcomeConfiguration : IEntityTypeConfiguration<Outcome>
{
    public void Configure(EntityTypeBuilder<Outcome> builder)
    {
        builder.ToTable("outcomes");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Label).IsRequired();
    }
}
