export default interface AllowedMigrations {
	recreateTable?: boolean;
	dropTable?: boolean;
	dropColumn?: boolean;
	alterPrimaryKey?: boolean;
	removeForeignKey?: boolean;
	alterForeignKey?: boolean;
	continueWithoutRollback?: boolean;
}