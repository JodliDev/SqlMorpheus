interface MigrationInstructions {
	oldTableName?: string;
	recreate: boolean;
	
	/**
	 * Stores changes to column (0: name in the database, last: current name in code)
	 */
	renamedColumns: string[][];
}