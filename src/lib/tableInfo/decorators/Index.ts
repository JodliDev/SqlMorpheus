import {TableClassInterface, Class} from "../../typings/TableClassInterface.ts";
import "polyfill-symbol-metadata"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme
import {getTableStructure, getTableStructureFromMetadata} from "../getTableStructure.ts";

/**
 * Decorator function to create an index on one or more columns of a table.
 * This decorator must be used at the head of the class.
 *
 * @param columns - The columns that will be part of the index (in order).
 * @param options - Additional options. If no name is provided, the name is generated from the table and column names.
 */
export default function Index<T extends TableClassInterface>(
	columns: (keyof T)[],
	options?: {
		name?: string,
		unique?: boolean,
	},
) {
	return (table: Class<T>, context?: any) => {
		const tableInfo = context?.metadata ? getTableStructureFromMetadata(context.metadata) : getTableStructure(table);
		if(!tableInfo.indexes)
			tableInfo.indexes = [];
		
		tableInfo.indexes.push({
			name: options?.name,
			columns: columns.map(column => column.toString()),
			isUnique: !!options?.unique,
		});
	}
}