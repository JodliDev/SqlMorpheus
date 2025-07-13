export default class MigrationHistory {
	fromVersion: number = 0;
	toVersion: number = 1;
	upSql: string = "";
	downSql: string = "";
	
	constructor(fromVersion: number, toVersion: number, upSql: string, downSql: string) {
		this.fromVersion = fromVersion;
		this.toVersion = toVersion;
		this.upSql = upSql;
		this.downSql = downSql;
	}
}