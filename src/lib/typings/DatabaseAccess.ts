export interface DatabaseAccess {
	createBackup?(backupName: string): Promise<void>;
	runGetStatement(query: string): Promise<unknown>
	runMultipleWriteStatements(query: string): Promise<void>
}