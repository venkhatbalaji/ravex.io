using Branding.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Branding.Infrastructure.Persistence.Configurations;

public sealed class ThemeConfiguration : IEntityTypeConfiguration<Theme>
{
    public void Configure(EntityTypeBuilder<Theme> builder)
    {
        builder.ToTable("theme");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.BrandName).IsRequired();
        builder.Property(t => t.AccentColor).IsRequired();
        builder.Property(t => t.Accent2Color).IsRequired();
        builder.Property(t => t.Font).HasConversion<string>().IsRequired();
    }
}
