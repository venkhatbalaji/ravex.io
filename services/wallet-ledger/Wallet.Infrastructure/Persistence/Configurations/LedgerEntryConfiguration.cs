using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Wallet.Domain.Entities;

namespace Wallet.Infrastructure.Persistence.Configurations;

public sealed class LedgerEntryConfiguration : IEntityTypeConfiguration<LedgerEntry>
{
    public void Configure(EntityTypeBuilder<LedgerEntry> builder)
    {
        builder.ToTable("ledger_entries");
        builder.HasKey(l => l.Id);
        builder.HasOne<Account>().WithMany().HasForeignKey(l => l.AccountId);
        builder.HasIndex(l => new { l.AccountId, l.Reason, l.CreatedAt });
    }
}
