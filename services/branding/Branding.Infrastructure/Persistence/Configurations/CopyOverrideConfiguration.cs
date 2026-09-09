using Branding.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Branding.Infrastructure.Persistence.Configurations;

public sealed class CopyOverrideConfiguration : IEntityTypeConfiguration<CopyOverride>
{
    public void Configure(EntityTypeBuilder<CopyOverride> builder)
    {
        builder.ToTable("copy_overrides");
        builder.HasKey(c => c.Key);
        builder.Property(c => c.Key).HasMaxLength(200);
        builder.Property(c => c.Value).IsRequired();
    }
}
