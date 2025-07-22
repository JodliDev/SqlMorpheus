import {TableClassInterface, Class} from "../../typings/TableClassInterface";
import {getTableInfo, getTableInfoFromMetadata} from "../TableInfo";
import "polyfill-symbol-metadata"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme
import {ForeignKeyActions} from "../../typings/ForeignKeyInfo";

/**
 * Decorator function to define a foreign key relationship for a database table.
 *
 * @param toTable - The target table class to which the foreign key points.
 * @param toColumn - The column name in the target table to which the foreign key points.
 * @param options - Additional options.
 */
export default function ForeignKey<
	TOther extends TableClassInterface
>(
	toTable: Class<TOther>,
	toColumn: keyof TOther,
	options?: {
		onDelete?: ForeignKeyActions,
		onUpdate?: ForeignKeyActions
	}
) {
	return (table: any, context: any) => {
		
		const metadata = context?.metadata ? getTableInfoFromMetadata(context.metadata) : getTableInfo(table);
		if(!metadata.foreignKeys)
			metadata.foreignKeys = [];
		
		metadata.foreignKeys.push({
			fromTable: "",
			fromColumn: context.name ?? context, //to stay compatible with old decorator structure (see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#decorator-metadata)
			toTable: toTable.name,
			toColumn: toColumn.toString(),
			onDelete: options?.onDelete,
			onUpdate: options?.onUpdate,
		});
	}
}