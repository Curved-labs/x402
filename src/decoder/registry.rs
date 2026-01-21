use std::collections::HashMap;
use std::sync::Arc;

use solana_sdk::pubkey::Pubkey;

use super::{
    drift_v2, jupiter, kamino, marginfi, spl_token::SplTokenDecoder, squads::SquadsDecoder,
    system::SystemDecoder, token_2022::Token2022Decoder, ProgramDecoder,
};

pub struct DecoderRegistry {
    decoders: HashMap<Pubkey, Arc<dyn ProgramDecoder>>,
}

impl DecoderRegistry {
    pub fn default_set() -> Self {
        let mut decoders: HashMap<Pubkey, Arc<dyn ProgramDecoder>> = HashMap::new();

        // Core SPL + system programs
        let system = Arc::new(SystemDecoder::new());
        decoders.insert(system.program_id(), system);

        let spl = Arc::new(SplTokenDecoder::new());
        decoders.insert(spl.program_id(), spl);

        let token22 = Arc::new(Token2022Decoder::new());
        decoders.insert(token22.program_id(), token22);

        // Multisig governance
        let squads = Arc::new(SquadsDecoder::new());
        decoders.insert(squads.program_id(), squads);

        // DeFi protocols (Anchor programs behind the generic decoder)
        let jup = Arc::new(jupiter::decoder());
        decoders.insert(jup.program_id(), jup);

        let drift = Arc::new(drift_v2::decoder());
        decoders.insert(drift.program_id(), drift);

        let kamino_d = Arc::new(kamino::decoder());
        decoders.insert(kamino_d.program_id(), kamino_d);

        let marginfi_d = Arc::new(marginfi::decoder());
        decoders.insert(marginfi_d.program_id(), marginfi_d);

        Self { decoders }
    }

    pub fn get(&self, program_id: &Pubkey) -> Option<&Arc<dyn ProgramDecoder>> {
        self.decoders.get(program_id)
    }

    pub fn registered_program_ids(&self) -> Vec<Pubkey> {
        self.decoders.keys().copied().collect()
    }
}
