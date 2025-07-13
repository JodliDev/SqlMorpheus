export interface DatabaseAccess {
	createBackup?(name: string): Promise<void>;
	runGetStatement(query: string): Promise<unknown>
	runMultipleWriteStatements(query: string): Promise<void>
}