export type ProviderParsingClassification =
  | "native_structured_object"
  | "valid_json_text"
  | "string_wrapped_json"
  | "markdown_wrapped_json"
  | "malformed_json"
  | "truncated_json"
  | "incomplete_provider_response"
  | "non_json_prose"
  | "provider_refusal"
  | "provider_transport_failure";

export type ProviderParsingStage =
  | "provider_native_parsed"
  | "json_text_parse"
  | "string_unwrap"
  | "markdown_json_strip"
  | "json_parse_failed"
  | "provider_transport";

export type ProviderResponseFormat = "json_schema" | "text" | "unknown";
