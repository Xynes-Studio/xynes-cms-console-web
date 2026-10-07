import type { GENERATED_DELIVERY_CONTRACT } from "./delivery-contract.generated";

type Contract = typeof GENERATED_DELIVERY_CONTRACT;
export type DirectoryField =
  Contract["operations"]["directory"]["fields"][number];
export type DeliveryField = Contract["operations"]["entry"]["fields"][number];
export type IntegrationTarget =
  | {
      readonly kind: "directory";
      readonly directoryId: string;
      readonly label: string;
      readonly breadcrumb: string;
    }
  | {
      readonly kind: "entry";
      readonly entryId: string;
      readonly label: string;
    };
export type DeliveryState = Contract["deliveryStates"][number] | "unknown";
export type IntegrationContext = {
  readonly workspaceId: string;
  readonly workspaceSlug: string;
  readonly apiBaseUrl: string;
  readonly target: IntegrationTarget;
  readonly publicationState?:
    "draft" | "scheduled" | "published" | "published-with-changes" | "archived";
  readonly deliveryState?: DeliveryState;
};
export type DirectoryIntegrationOptions = {
  readonly sortBy?: Contract["operations"]["directory"]["sortBy"][number];
  readonly sortDirection?: Contract["operations"]["directory"]["sortDirection"][number];
  readonly limit?: number;
  readonly offset?: number;
  readonly search?: string;
  readonly fields?: readonly DirectoryField[];
};
export type EntryIntegrationOptions = {
  readonly fields?: readonly DeliveryField[];
};
export type DirectoryRequestOptions = Required<
  Omit<DirectoryIntegrationOptions, "search" | "fields">
> & { readonly search?: string; readonly fields: readonly DirectoryField[] };
export type EntryRequestOptions = { readonly fields: readonly DeliveryField[] };
type RequestBase = {
  readonly method: "GET";
  readonly url: string;
  readonly contextKey: string;
  readonly headers: Readonly<{ Authorization: "Bearer ${XYNES_API_KEY}" }>;
};
export type IntegrationRequest =
  | (RequestBase & {
      readonly kind: "directory";
      readonly fields: readonly DirectoryField[];
      readonly options: Readonly<DirectoryRequestOptions>;
    })
  | (RequestBase & {
      readonly kind: "entry";
      readonly fields: readonly DeliveryField[];
      readonly options: Readonly<EntryRequestOptions>;
    });
export type IntegrationRequestErrorCode =
  "INVALID_CONTEXT" | "INVALID_OPTIONS" | "INVALID_API_BASE_URL";
export type IntegrationRequestResult =
  | { readonly ok: true; readonly request: IntegrationRequest }
  | {
      readonly ok: false;
      readonly error: { readonly code: IntegrationRequestErrorCode };
    };
export type RequestSnippets = {
  readonly url: string;
  readonly curl: string;
  readonly serverFetch: string;
};
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type ExampleEntry = {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly publishedAt?: string;
  readonly body?: { readonly [key: string]: JsonValue } | null;
};
export type ExampleResponse = {
  readonly kind: "static-example";
  readonly response: {
    readonly ok: true;
    readonly data:
      | { readonly entry: ExampleEntry }
      | {
          readonly items: readonly ExampleEntry[];
          readonly page: {
            readonly limit: number;
            readonly offset: number;
            readonly hasMore: false;
          };
        };
  };
};
export type ResponseField = {
  readonly name: DeliveryField;
  readonly type: "string" | "string[]" | "object|null";
  readonly required: boolean;
};
