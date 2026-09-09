using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Branding.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "branding");

            migrationBuilder.CreateTable(
                name: "copy_overrides",
                schema: "branding",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Value = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_copy_overrides", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "theme",
                schema: "branding",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandName = table.Column<string>(type: "text", nullable: false),
                    LogoLightUrl = table.Column<string>(type: "text", nullable: false),
                    LogoDarkUrl = table.Column<string>(type: "text", nullable: false),
                    AccentColor = table.Column<string>(type: "text", nullable: false),
                    Accent2Color = table.Column<string>(type: "text", nullable: false),
                    Font = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_theme", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "copy_overrides",
                schema: "branding");

            migrationBuilder.DropTable(
                name: "theme",
                schema: "branding");
        }
    }
}
