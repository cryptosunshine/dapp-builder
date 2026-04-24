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
    await user.clear(screen.getByLabelText(/model/i));
    await user.type(screen.getByLabelText(/model/i), 'claude-4');
    await user.clear(screen.getByLabelText(/api key/i));
    await user.type(screen.getByLabelText(/api key/i), 'sk-test-key');

    // Click clear form
    await user.click(screen.getByRole('button', { name: /clear form/i }));

    // Fields should be back to initial defaults
    const addressInput = screen.getByLabelText(/contract address/i) as HTMLInputElement;
    expect(addressInput).toHaveValue('');

    const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;
    expect(modelInput).toHaveValue('gpt-5.4');

    const apiKeyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
    expect(apiKeyInput).toHaveValue('');
  });

  test('shows a description for the currently selected skill', async () => {
    const user = userEvent.setup();

    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    // Default skill is token-dashboard
    expect(screen.getByText(/View token balances/i)).toBeInTheDocument();

    // Switching skill updates the description
    const skillSelect = screen.getByLabelText(/skill/i);
    await user.selectOptions(skillSelect, 'nft-mint-page');
    expect(screen.getByText(/Mint NFTs/i)).toBeInTheDocument();
  });

  test('allows submitting without an API key for deterministic-only runs', async () => {
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
      skill: 'token-dashboard',
      model: 'gpt-5.4',
      apiKey: '',
    });
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
});
