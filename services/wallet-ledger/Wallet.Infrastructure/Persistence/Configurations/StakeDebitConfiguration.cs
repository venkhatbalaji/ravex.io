using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Wallet.Domain.Entities;

namespace Wallet.Infrastructure.Persistence.Configurations;

public sealed class StakeDebitConfiguration : IEntityTypeConfiguration<StakeDebit>
{
    public void Configure(EntityTypeBuilder<StakeDebit> builder)
    {
        builder.ToTable("stake_debits", t => t.HasCheckConstraint("stake_debit_positive", "\"Amount\" > 0"));
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).ValueGeneratedNever();
        builder.HasIndex(d => new { d.UserId, d.CreatedAt });
    }
}
