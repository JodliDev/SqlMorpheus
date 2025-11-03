export interface DatabaseAccess {
	createBackup?(backupName: string): Promise<void>;
	runReadStatement(query: string): Promise<unknown>
	runWriteStatement(query: string): Promise<void>
	runTransaction(query: string): Promise<void>
}