// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BuilderForm } from '../src/components/BuilderForm';

describe('BuilderForm', () => {
  test('shows streamlined experience goals and the built-in generator by default', () => {
    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    expect(screen.getByRole('group', { name: /experience goal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto route/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /token dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nft mint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voting/i })).toBeInTheDocument();
    expect(screen.getByText(/wallet connection, guided flow, and safety copy are included automatically/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /model account/i })).toHaveValue('local-hermes-agent');
    expect(screen.getByText(/default generator/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^api key$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use sample contract/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear form/i })).not.toBeInTheDocument();
  });

  test('submits the default built-in generator without exposing an API key', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

    await user.type(screen.getByLabelText(/contract address/i), '0x1234567890123456789012345678901234567890');
    await user.click(screen.getByRole('button', { name: /generate dapp preview/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skill: 'auto',
      skills: ['auto', 'injected-wallet', 'guided-flow', 'risk-explainer'],
      model: 'current-hermes-model',
      apiKey: '',
      modelConfig: {
        providerId: 'local-hermes-agent',
        baseUrl: 'http://localhost',
        model: 'current-hermes-model',
        apiKey: '',
      },
    }));
  });

  test('selects a primary experience goal while keeping product support skills automatic', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

    await user.click(screen.getByRole('button', { name: /token dashboard/i }));
    expect(screen.getByRole('button', { name: /token dashboard/i })).toHaveAttribute('aria-pressed', 'true');

    await user.type(screen.getByLabelText(/contract address/i), '0x1234567890123456789012345678901234567890');
    await user.click(screen.getByRole('button', { name: /generate dapp preview/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      skill: 'token-dashboard',
      skills: ['token-dashboard', 'injected-wallet', 'guided-flow', 'risk-explainer'],
    }));
  });

  test('submits custom API model config only when custom account is selected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

    await user.selectOptions(screen.getByLabelText(/model account/i), 'custom');
    await user.clear(screen.getByRole('textbox', { name: /^base url$/i }));
    await user.type(screen.getByRole('textbox', { name: /^base url$/i }), 'https://api.openai.com/v1');
    await user.clear(screen.getByLabelText(/^Model$/i));
    await user.type(screen.getByLabelText(/^Model$/i), 'gpt-5.4');
    await user.type(screen.getByRole('textbox', { name: /^api key$/i }), 'secret');
    await user.type(screen.getByLabelText(/contract address/i), '0x1234567890123456789012345678901234567890');
    await user.click(screen.getByRole('button', { name: /generate dapp preview/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
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
    await user.clear(addressInput);
    await user.type(addressInput, '0xshort');

    expect(screen.getByText(/Address too short/i)).toBeInTheDocument();

    await user.clear(addressInput);
    await user.type(addressInput, '0x1234567890123456789012345678901234567890');

    await waitFor(() => {
      expect(screen.getByText(/Valid address/i)).toBeInTheDocument();
    });
  });

  test('blocks submission when contract address format is invalid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

    const addressInput = screen.getByLabelText(/contract address/i);
    await user.clear(addressInput);
    await user.type(addressInput, '0xinvalid');

    await user.click(screen.getByRole('button', { name: /generate dapp preview/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Please enter a valid contract address/i)).toBeInTheDocument();
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

    const submitButton = screen.getByRole('button', { name: /generate dapp preview/i });
    const addressInput = screen.getByLabelText(/contract address/i);
    addressInput.removeAttribute('required');

    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Please enter a valid contract address/i)).toBeInTheDocument();
  });
});
