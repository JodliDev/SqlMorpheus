import {NotAllowedChangeEntry} from "../Migrations";

export default class NotAllowedException extends Error {
	constructor(entries: NotAllowedChangeEntry[]) {
		let message = "Some destructive changes need to be confirmed. To confirm, add to preMigration():\n";
		for(const entry of entries) {
			message += `\t\tmigrations.allowMigration(${entry.version}, ${entry.tableName}, "${entry.type}");\n`;
		}
		super(message);
	}
}