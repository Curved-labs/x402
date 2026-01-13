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

