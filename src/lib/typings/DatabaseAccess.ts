export interface DatabaseAccess {
	createBackup?(backupName: string): Promise<any>;
	runReadStatement(query: string): Promise<unknown>
	runWriteStatement(query: string): Promise<any>
	runTransaction(query: string): Promise<any>
}