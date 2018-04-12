class Complaint < ApplicationRecord
  validates :sender_id, presence: true
  validates :bad_id, presence: true
  validates :active, presence: true
end
