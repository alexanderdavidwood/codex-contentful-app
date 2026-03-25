import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Flex,
  FormControl,
  Heading,
  Note,
  Paragraph,
  TextInput,
} from "@contentful/f36-components";
import type { AppExtensionSDK } from "@contentful/app-sdk";
import { useAutoResizer, useSDK } from "@contentful/react-apps-toolkit";

import type { BuilderInstallationParameters } from "../types.js";

const DEFAULT_VALUES: BuilderInstallationParameters = {
  tenantId: "internal-demo",
  githubInstallationId: "",
  openAiSecretRef: "",
  previewTarget: "contentful-preview",
  productionTarget: "contentful-production",
  policyProfileId: "default",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787",
  featureFlags: {
    enablePreviewSync: true,
  },
};

export function ConfigScreen() {
  const sdk = useSDK<AppExtensionSDK>();
  useAutoResizer();
  const [parameters, setParameters] = useState<BuilderInstallationParameters>(DEFAULT_VALUES);

  useEffect(() => {
    const currentParameters = sdk.parameters.installation as Partial<BuilderInstallationParameters> | undefined;
    if (currentParameters) {
      setParameters({
        ...DEFAULT_VALUES,
        ...currentParameters,
        featureFlags: {
          ...DEFAULT_VALUES.featureFlags,
          ...currentParameters.featureFlags,
        },
      });
    }

    return sdk.app.onConfigure(async () => {
      const targetState = await sdk.app.getCurrentState();
      return {
        parameters,
        targetState,
      };
    });
  }, [sdk, parameters]);

  return (
    <Flex flexDirection="column" gap="spacingL">
      <div>
        <Heading>Codex Builder Setup</Heading>
        <Paragraph>
          This configuration stores the builder tenant binding and backend URL used by the page location.
        </Paragraph>
      </div>

      <Note variant="primary">
        Stage 1 uses a Render-compatible backend shape. Keep secrets server-side and point the app at the public API URL.
      </Note>

      <FormControl>
        <FormControl.Label>API base URL</FormControl.Label>
        <TextInput
          value={parameters.apiBaseUrl}
          onChange={(event) =>
            setParameters((current) => ({
              ...current,
              apiBaseUrl: event.target.value,
            }))
          }
        />
        <FormControl.HelpText>
          Use the deployed API URL, for example `https://your-api.onrender.com`.
        </FormControl.HelpText>
      </FormControl>

      <FormControl>
        <FormControl.Label>Tenant ID</FormControl.Label>
        <TextInput
          value={parameters.tenantId}
          onChange={(event) =>
            setParameters((current) => ({
              ...current,
              tenantId: event.target.value,
            }))
          }
        />
      </FormControl>

      <FormControl>
        <FormControl.Label>GitHub installation ID</FormControl.Label>
        <TextInput
          value={parameters.githubInstallationId ?? ""}
          onChange={(event) =>
            setParameters((current) => ({
              ...current,
              githubInstallationId: event.target.value,
            }))
          }
        />
      </FormControl>

      <FormControl>
        <FormControl.Label>OpenAI secret reference</FormControl.Label>
        <TextInput
          value={parameters.openAiSecretRef ?? ""}
          onChange={(event) =>
            setParameters((current) => ({
              ...current,
              openAiSecretRef: event.target.value,
            }))
          }
        />
        <FormControl.HelpText>
          The deployed API itself still needs `OPENAI_API_KEY` configured server-side for Codex execution.
        </FormControl.HelpText>
      </FormControl>

      <FormControl>
        <FormControl.Label>Preview target</FormControl.Label>
        <TextInput
          value={parameters.previewTarget}
          onChange={(event) =>
            setParameters((current) => ({
              ...current,
              previewTarget: event.target.value,
            }))
          }
        />
      </FormControl>

      <FormControl>
        <FormControl.Label>Production target</FormControl.Label>
        <TextInput
          value={parameters.productionTarget}
          onChange={(event) =>
            setParameters((current) => ({
              ...current,
              productionTarget: event.target.value,
            }))
          }
        />
      </FormControl>

      <FormControl>
        <FormControl.Label>Policy profile ID</FormControl.Label>
        <TextInput
          value={parameters.policyProfileId}
          onChange={(event) =>
            setParameters((current) => ({
              ...current,
              policyProfileId: event.target.value,
            }))
          }
        />
      </FormControl>

      <Checkbox
        isChecked={Boolean(parameters.featureFlags.enablePreviewSync)}
        onChange={(event) =>
          setParameters((current) => ({
            ...current,
            featureFlags: {
              ...current.featureFlags,
              enablePreviewSync: event.target.checked,
            },
          }))
        }
      >
        Enable preview sync messaging
      </Checkbox>

      <Button
        variant="primary"
        onClick={() => sdk.notifier.success("Configuration will be saved when you click Install or Save.")}
      >
        Validate Setup
      </Button>
    </Flex>
  );
}
