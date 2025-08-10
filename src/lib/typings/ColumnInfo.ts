export interface ColumnInfo {
	name: string
	type: string
	maxLength?: number
	defaultValue?: string
	isPrimaryKey: boolean
}