import AllowedMigrations from "./AllowedMigrations";

export interface RenameData {
	oldName: string;
	newName: string;
}

export default interface MigrationInstructions {
	tableRenaming?: RenameData;
	recreate: boolean;
	
	/**
	 * Stores changes to column. One entry per column.
	 */
	renamedColumns: RenameData[];
	
	allowedMigrations: AllowedMigrations;
	usedMigrations: Record<string, boolean>
}