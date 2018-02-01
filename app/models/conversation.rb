class Conversation < ApplicationRecord
  has_many :messages, dependent: :destroy
  belongs_to :boy
  belongs_to :girl
  validates :boy_id, uniqueness: {scope: :girl_id}
end
