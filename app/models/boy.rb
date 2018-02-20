class Boy < User
  has_many :conversation
  has_many :messages, dependent: :destroy

  validates :name, presence: :true
  validates :surname, presence: :true
  validates :age, presence: :true
  mount_uploader :avatar, AvatarUploader
  validates_presence_of   :avatar
  validates_integrity_of  :avatar
  validates_processing_of :avatar
end
