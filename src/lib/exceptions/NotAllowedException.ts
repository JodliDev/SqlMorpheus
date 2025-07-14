import AllowedMigrations from "../typings/AllowedMigrations.ts";

export default class NotAllowedException extends Error {
	constructor(version: number, tableName: string, type: keyof AllowedMigrations) {
		const information = `You have to enable "${type}" for version "${version}" and table "${tableName}"`;
		switch(type) {
			case "continueWithoutRollback":
				super(`Some changes can not be rolled back automatically. ${information}`);
				break;
			case "dropColumn":
				super(`Not allowed to drop column. ${information}`);
				break;
			case "dropTable":
				super(`Not allowed to drop table. ${information}`);
				break;
			case "recreateTable":
				super(`Not allowed to recreate table. ${information}`);
				break;
			case "alterForeignKey":
				super(`Not allowed to alter existing foreign key. ${information}`);
				break;
			case "alterPrimaryKey":
				super(`Not allowed to alter primary key. ${information}`);
				break;
			case "removeForeignKey":
				super(`Not allowed to remove existing foreign key. ${information}`);
				break;
		}
	}
}