type AnySchema = NullSchema | BooleanSchema | NumberSchema | StringSchema | AnyEnumSchema | AnyArraySchema | AnyObjectSchema

interface NullSchema {
  type: 'null'
}

interface BooleanSchema {
  type: 'boolean'
}

interface NumberSchema {
  type: 'number'
}

interface StringSchema {
  type: 'string'
}

interface AnyEnumSchema extends EnumSchema<any> {}
interface EnumSchema<Enum> {
  enum: Enum[]
}

interface AnyArraySchema extends ArraySchema<AnySchema> {}
interface ArraySchema<ItemSchema extends AnySchema> {
  type: 'array'
  items: ItemSchema
}

interface AnyObjectSchema extends ObjectSchema<Record<string, AnySchema>, string> {}
interface ObjectSchema<Properties extends Record<string, AnySchema>, Required extends keyof Properties> {
  additionalProperties?: boolean
  type: 'object'
  properties: Properties
  required: Required[]
}

interface ExtractedSchemaArray<Schema> extends Array<ExtractSchemaType<Schema>> {}

declare type ExtractedSchemaObject<Properties, Required> = {
  [Key in keyof Properties]: (Key extends Required ? ExtractSchemaType<Properties[Key]> : ExtractSchemaType<Properties[Key]> | undefined)
}

declare type ExtractSchemaType<Schema> = (
    Schema extends EnumSchema<infer Enum> ? Enum
  : Schema extends NullSchema ? null
  : Schema extends BooleanSchema ? boolean
  : Schema extends NumberSchema ? number
  : Schema extends StringSchema ? string
  : Schema extends ArraySchema<infer ItemSchema> ? ExtractedSchemaArray<ItemSchema>
  : Schema extends ObjectSchema<infer Properties, infer Required> ? ExtractedSchemaObject<Properties, Required>
  : never
)

declare namespace factory {
  interface ValidationError {
    field: string
    message: string
    value: unknown
    type: string
  }
}

declare interface Validator<Schema, Output = ExtractSchemaType<Schema>> {
  (input: unknown, options?: any): input is Output
  errors: factory.ValidationError[]
  toJSON(): Schema
}

declare interface Filter<Output> {
  (input: Output, options?: any): Output
}

declare interface Factory {
  <Properties extends Record<string, AnySchema>, Required extends keyof Properties> (schema: ObjectSchema<Properties, Required>, options?: any): Validator<ObjectSchema<Properties, Required>>
  <Schema extends AnySchema> (schema: Schema, options?: any): Validator<Schema>

  createFilter<Properties extends Record<string, AnySchema>, Required extends keyof Properties> (schema: ObjectSchema<Properties, Required>, options?: any): Filter<ExtractedSchemaObject<Properties, Required>>
  createFilter<Schema extends AnySchema> (schema: Schema, options?: any): Filter<ExtractSchemaType<Schema>>
}

declare const factory: Factory

export = factory
