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
interface EnumSchema<T> {
  enum: T[]
}

interface AnyArraySchema extends ArraySchema<AnySchema> {}
interface ArraySchema<T extends AnySchema> {
  type: 'array'
  items: T
}

interface AnyObjectSchema extends ObjectSchema<Record<string, AnySchema>, string> {}
interface ObjectSchema<T extends Record<string, AnySchema>, R extends keyof T> {
  additionalProperties?: boolean
  type: 'object'
  properties: T
  required: R[]
}

interface ExtractedSchemaArray<T> extends Array<ExtractSchemaType<T>> {}

declare type ExtractedSchemaObject<T, R> = {
  [K in keyof T]: (K extends R ? ExtractSchemaType<T[K]> : ExtractSchemaType<T[K]> | undefined)
}

declare type ExtractSchemaType<Type> = (
  Type extends EnumSchema<infer T> ? T
  : Type extends NullSchema ? null
  : Type extends BooleanSchema ? boolean
  : Type extends NumberSchema ? number
  : Type extends StringSchema ? string
  : Type extends ArraySchema<infer T> ? ExtractedSchemaArray<T>
  : Type extends ObjectSchema<infer T, infer R> ? ExtractedSchemaObject<T, R>
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
  <T extends Record<string, AnySchema>, R extends keyof T> (schema: ObjectSchema<T, R>, options?: any): Validator<ObjectSchema<T, R>>
  <T extends AnySchema> (schema: T, options?: any): Validator<T>

  createFilter<T extends Record<string, AnySchema>, R extends keyof T> (schema: ObjectSchema<T, R>, options?: any): Filter<ExtractedSchemaObject<T, R>>
  createFilter<T extends AnySchema> (schema: T, options?: any): Filter<ExtractSchemaType<T>>
}

declare const factory: Factory

export = factory
