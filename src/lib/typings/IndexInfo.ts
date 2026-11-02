export interface IndexInfo {
	name: string;
	columns: string[];
	isUnique: boolean;
}

/**
 * Index definition as provided by the user. If no name is provided, a name is generated from the table and column names.
 */
export interface InputIndexInfo extends Omit<IndexInfo, "name"> {
	name?: string;
}
