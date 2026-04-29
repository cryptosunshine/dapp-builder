// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BuilderForm } from '../src/components/BuilderForm';
import { builderTaskInputSchema } from '../shared/schema';

describe('BuilderForm', () => {
  test('fills the contract address with a schema-valid sample value when requested', async () => {
    const user = userEvent.setup();

    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    await user.click(screen.getByRole('button', { name: /use sample contract/i }));

    const addressInput = screen.getByLabelText(/contract address/i) as HTMLInputElement;

    expect(addressInput).toHaveValue('0x1234567890123456789012345678901234567890');
    expect(() => builderTaskInputSchema.shape.contractAddress.parse(addressInput.value)).not.toThrow();
  });

  test('resets all fields to initial state when clear form button is clicked', async () => {
    const user = userEvent.setup();

    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    // Fill in some values different from defaults
    await user.clear(screen.getByLabelText(/contract address/i));
    await user.type(screen.getByLabelText(/contract address/i), '0x1234567890123456789012345678901234567890');
    await user.selectOptions(screen.getByLabelText(/model account/i), 'custom');
    await user.clear(screen.getByLabelText(/^model$/i));
    await user.type(screen.getByLabelText(/^model$/i), 'claude-4');
    await user.clear(screen.getByRole('textbox', { name: /^api key$/i }));
    await user.type(screen.getByRole('textbox', { name: /^api key$/i }), 'sk-test-key');

    // Click clear form
    await user.click(screen.getByRole('button', { name: /clear form/i }));

    // Fields should be back to initial defaults
    const addressInput = screen.getByLabelText(/contract address/i) as HTMLInputElement;
    expect(addressInput).toHaveValue('');

    const modelAccountInput = screen.getByLabelText(/model account/i) as HTMLSelectElement;
    expect(modelAccountInput).toHaveValue('nvidia-deepseek-v4-pro');
    expect(screen.queryByLabelText(/^model$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^api key$/i })).not.toBeInTheDocument();
  });

  test('shows categorized skill options', () => {
    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    expect(screen.getByText(/Business direction/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Token dashboard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/NFT mint experience/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/EIP-6963 wallet discovery/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Transaction timeline/i)).toBeInTheDocument();
  });

  test('shows built-in model account helper copy by default', () => {
    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    expect(screen.getByText(/Built-in accounts use server-side keys/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /model account/i })).toHaveValue('nvidia-deepseek-v4-pro');
    expect(screen.queryByRole('textbox', { name: /^api key$/i })).not.toBeInTheDocument();
  });

  test('submits the selected built-in model account without an API key', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

    await user.type(screen.getByLabelText(/contract address/i), '0x1234567890123456789012345678901234567890');

    const submitButton = screen.getByRole('button', { name: /generate dapp preview/i });
    const form = submitButton.closest('form');
    if (!form) throw new Error('Builder form not found');

    expect(form).toBeValid();

    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skill: 'auto',
      skills: ['auto', 'injected-wallet', 'guided-flow', 'risk-explainer'],
      model: 'deepseek-ai/deepseek-v4-pro',
      apiKey: '',
      modelConfig: {
        providerId: 'nvidia-deepseek-v4-pro',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'deepseek-ai/deepseek-v4-pro',
        apiKey: '',
      },
    });
  });

  test('submits selected skills and model config', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

    await user.clear(screen.getByLabelText(/contract address/i));
    await user.type(screen.getByLabelText(/contract address/i), '0x1234567890123456789012345678901234567890');
    await user.click(screen.getByLabelText(/Auto/i));
    await user.click(screen.getByLabelText(/Token dashboard/i));
    await user.click(screen.getByLabelText(/EIP-6963 wallet discovery/i));
    await user.selectOptions(screen.getByLabelText(/model account/i), 'custom');
    await user.clear(screen.getByRole('textbox', { name: /^base url$/i }));
    await user.type(screen.getByRole('textbox', { name: /^base url$/i }), 'https://api.openai.com/v1');
    await user.clear(screen.getByLabelText(/^Model$/i));
    await user.type(screen.getByLabelText(/^Model$/i), 'gpt-5.4');
    await user.type(screen.getByRole('textbox', { name: /^api key$/i }), 'secret');
    await user.click(screen.getByRole('button', { name: /generate dapp preview/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skills: expect.arrayContaining(['token-dashboard', 'eip-6963-wallet-discovery', 'guided-flow']),
      modelConfig: {
        providerId: 'custom',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.4',
        apiKey: 'secret',
      },
    }));
  });

  test('shows a validation hint for invalid contract address format', async () => {
    const user = userEvent.setup();

    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    const addressInput = screen.getByLabelText(/contract address/i);

    // Type an invalid address (too short, not hex)
    await user.clear(addressInput);
    await user.type(addressInput, '0xshort');

    // Should show a warning hint
    expect(screen.getByText(/Address too short/i)).toBeInTheDocument();

    // Now type a valid address
    await user.clear(addressInput);
    await user.type(addressInput, '0x1234567890123456789012345678901234567890');

    // Should show a success hint
    await waitFor(() => {
      expect(screen.getByText(/Valid address/i)).toBeInTheDocument();
    });
  });

  test('blocks submission when contract address format is invalid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

    // Type an invalid address
    const addressInput = screen.getByLabelText(/contract address/i);
    await user.clear(addressInput);
    await user.type(addressInput, '0xinvalid');

    // Try submitting — should be blocked
    await user.click(screen.getByRole('button', { name: /generate dapp preview/i }));
    expect(onSubmit).not.toHaveBeenCalled();

    // Should render a visible submit error message
    expect(screen.getByText(/Please enter a valid contract address/i)).toBeInTheDocument();
  });

  test('clears submit error when clear form button is clicked', async () => {
    const user = userEvent.setup();

    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    // Trigger a submit error with an invalid address
    const addressInput = screen.getByLabelText(/contract address/i);
    addressInput.removeAttribute('required');
    await user.click(screen.getByRole('button', { name: /generate dapp preview/i }));

    // Verify the error message is shown
    expect(screen.getByText(/Please enter a valid contract address/i)).toBeInTheDocument();

    // Click clear form
    await user.click(screen.getByRole('button', { name: /clear form/i }));

    // Verify the error message is gone
    expect(screen.queryByText(/Please enter a valid contract address/i)).not.toBeInTheDocument();
  });

  test('shows chain metadata tooltip on hover and keyboard focus', async () => {
    const user = userEvent.setup();

    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    const chainSelect = screen.getByLabelText(/^chain$/i);
    expect(chainSelect).toBeInTheDocument();

    await user.hover(chainSelect);
    expect(screen.getByText(/chain id.*71/i)).toBeInTheDocument();
    expect(screen.getByText(/evmtestnet\.confluxrpc\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/cfx/i)).toBeInTheDocument();

    await user.unhover(chainSelect);
    expect(screen.queryByText(/chain id.*71/i)).not.toBeInTheDocument();

    await user.tab();
    await user.tab();
    expect(chainSelect).toHaveFocus();
    expect(screen.getByText(/chain id.*71/i)).toBeInTheDocument();

    await user.tab();
    expect(chainSelect).not.toHaveFocus();
    expect(screen.queryByText(/chain id.*71/i)).not.toBeInTheDocument();
  });

  test('blocks submission when contract address is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

    // The address input has HTML required attribute, so an empty form submit
    // is blocked by the browser before our handler runs.
    // Verify the submit button click does not call onSubmit when address is empty.
    const submitButton = screen.getByRole('button', { name: /generate dapp preview/i });

    // Disable HTML5 validation to test our own submit guard;
    // remove the 'required' attribute temporarily to test the JS fallback.
    const addressInput = screen.getByLabelText(/contract address/i);
    addressInput.removeAttribute('required');

    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();

    // Should show a submit-level error message
    expect(screen.getByText(/Please enter a valid contract address/i)).toBeInTheDocument();
  });
});
