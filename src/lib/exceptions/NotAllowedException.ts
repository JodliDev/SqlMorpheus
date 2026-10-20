import {NotAllowedChangeEntry} from "../Migrations.ts";
import {NO_COLUMN} from "../typings/AllowedMigrations.ts";

export default class NotAllowedException extends Error {
	constructor(entries: NotAllowedChangeEntry[]) {
		let message = "Some destructive changes need to be confirmed. To confirm, add to preMigration():\n";
		for(const entry of entries) {
			message += `\t\tmigrations.allowMigration(${entry.version}, "${entry.tableName}", "${entry.type.toString()}"${entry.column != NO_COLUMN ? `, "${entry.column}"` : ''});\n`;
		}
		super(message);
	}
}